import os

from seleniumbase import BaseCase

from test.end2end.helpers.helper import Helper

path_to_this_test_file_folder = os.path.dirname(os.path.abspath(__file__))
index_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "index.html")
)
index2_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "index2.html")
)
index3_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "index3.html")
)
index4_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "index4.html")
)

test_element11 = '//*[@data-testid="testPoint11"]'
test_element12 = '//*[@data-testid="testPoint12"]'
test_element21 = '//*[@data-testid="testPoint21"]'
test_element22 = '//*[@data-testid="testPoint22"]'
test_element30 = '//*[@data-testid="testPoint30"]'
test_element41 = '//*[@data-testid="testPoint41"]'
test_element42 = '//*[@data-testid="testPoint42"]'
test_element50 = '//*[@data-testid="testPoint50"]'
test_element60 = '//*[@data-testid="testPoint60"]'
test_element71 = '//*[@data-testid="testPoint71"]'
test_element72 = '//*[@data-testid="testPoint72"]'


# 071_pagebreak
class Test(BaseCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = Helper(self)

    def test_001(self):
        helper = Helper(self)
        helper.do_open(index_html_file_url)

        self.helper.assert_document_has_pages(7)
        # first "before" is the first in content flow
        # so it shouldn't trigger and create a blank page
        self.helper.assert_element_on_the_page(test_element11, 1)

        # counter "after" and "before" create only 1 page break
        self.helper.assert_element_on_the_page(test_element12, 1)
        self.helper.assert_element_on_the_page(test_element21, 2)
        self.helper.assert_element_on_the_page(test_element22, 2)
        self.helper.assert_element_on_the_page(test_element30, 3)
        self.helper.assert_element_on_the_page(test_element41, 4)
        self.helper.assert_element_on_the_page(test_element42, 4)
        self.helper.assert_element_on_the_page(test_element50, 5)

        # "forced" always creates a new page
        self.helper.assert_element_on_the_page(test_element60, 6)
        self.helper.assert_element_on_the_page(test_element71, 7)

        # last "after" is the last in content flow,
        # so it shouldn't trigger and create a blank page
        self.helper.assert_element_on_the_page(test_element72, 7)

    def test_002(self):
        helper = Helper(self)
        helper.do_open(index2_html_file_url)
        # Before the page start trigger, there is an invisible element that
        # should not prevent climbing up the “first children” and assigning
        # the outermost wrapper as the best candidate for page break.
        self.helper.assert_document_has_pages(1)

    def test_003(self):
        helper = Helper(self)
        helper.do_open(index3_html_file_url)
        # After the last "after" element, there are an invisible element
        # and a SCRIPT. They do not take part in the flow, so the last
        # "after" element must not create an empty page.
        self.helper.assert_document_has_pages(1)
        self.helper.assert_element_on_the_page(test_element11, 1)
        self.helper.assert_element_on_the_page(test_element12, 1)

    def test_004(self):
        helper = Helper(self)
        helper.do_open(index4_html_file_url)
        # A SCRIPT and an invisible element between "after" and "before"
        # must not produce a second page break and an empty page.
        self.helper.assert_document_has_pages(2)
        self.helper.assert_element_on_the_page(test_element11, 1)
        self.helper.assert_element_on_the_page(test_element21, 2)
