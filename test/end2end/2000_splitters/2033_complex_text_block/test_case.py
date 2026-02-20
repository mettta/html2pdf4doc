import os

from seleniumbase import BaseCase

from test.end2end.helpers.helper import Helper

path_to_this_test_file_folder = os.path.dirname(os.path.abspath(__file__))
case1_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "case1.html")
)
case2_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "case2.html")
)
case3_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "case3.html")
)
case4_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "case4.html")
)
case5_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "case5.html")
)
case6_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "case6.html")
)
text_line = ("//html2pdf4doc-text-line")
text_group = ("//html2pdf4doc-text-group")
# 6 lines are divided into 4 groups (2 lines first and last form a group)
lines_1_2 = '//html2pdf4doc-text-group[@data-child="0"]'
lines_3 = '//html2pdf4doc-text-group[@data-child="1"]'
lines_4 = '//html2pdf4doc-text-group[@data-child="2"]'
lines_5_6 = '//html2pdf4doc-text-group[@data-child="3"]'


class Test(BaseCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = Helper(self)

    def test_01(self):
        # *1
        # all 6 lines remain on the first page;
        self.helper.do_open(case1_html_file_url)
        self.helper.assert_document_has_pages(1)

    def test_02(self):
        # *2
        # will leave 4 lines on the first page and move 2 lines to the next;
        self.helper.do_open(case2_html_file_url)
        self.helper.assert_document_has_pages(2)
        self.helper.assert_element_on_the_page(lines_1_2, 1)
        self.helper.assert_element_on_the_page(lines_3, 1)
        self.helper.assert_element_on_the_page(lines_4, 1)
        self.helper.assert_element_on_the_page(lines_5_6, 2)

    def test_03(self):
        # *3
        # will leave 4 lines on the first page and move 2 lines to the next;
        self.helper.do_open(case3_html_file_url)
        self.helper.assert_document_has_pages(2)
        self.helper.assert_element_on_the_page(lines_1_2, 1)
        self.helper.assert_element_on_the_page(lines_3, 1)
        self.helper.assert_element_on_the_page(lines_4, 1)
        self.helper.assert_element_on_the_page(lines_5_6, 2)

    def test_04(self):
        # *4
        # will leave 3 lines on the first page and move 3 lines to the next;
        self.helper.do_open(case4_html_file_url)
        self.helper.assert_document_has_pages(2)
        self.helper.assert_element_on_the_page(lines_1_2, 1)
        self.helper.assert_element_on_the_page(lines_3, 1)
        self.helper.assert_element_on_the_page(lines_4, 2)
        self.helper.assert_element_on_the_page(lines_5_6, 2)
        # check that the strings split as expected
        self.helper.assert_element_contains(lines_1_2,'eiusmod')
        self.helper.assert_element_contains(lines_1_2,'laboris')
        self.helper.assert_element_contains(lines_1_2,'aliqua')
        self.helper.assert_element_contains(lines_3,'mollit')
        self.helper.assert_element_contains(lines_3,'duis ea')
        self.helper.assert_element_contains(lines_3,'aliqui')
        self.helper.assert_element_contains(lines_4,'cupidatat fugiat sit')
        self.helper.assert_element_contains(lines_4,'labore eiusmod sunt.')
        self.helper.assert_element_contains(lines_5_6,'Esse dolor tempor minim')
        self.helper.assert_element_contains(lines_5_6,'Proident')

    def test_05(self):
        # *5
        # will leave 2 lines on the first page and move 4 lines to the next;
        self.helper.do_open(case5_html_file_url)
        self.helper.assert_document_has_pages(2)
        self.helper.assert_element_on_the_page(lines_1_2, 1)
        self.helper.assert_element_on_the_page(lines_3, 2)
        self.helper.assert_element_on_the_page(lines_4, 2)
        self.helper.assert_element_on_the_page(lines_5_6, 2)

    def test_06(self):
        # *6
        # will move all the text to the second page.
        self.helper.do_open(case6_html_file_url)
        self.helper.assert_document_has_pages(2)
        self.helper.assert_element_on_the_page(lines_1_2, 2)
        self.helper.assert_element_on_the_page(lines_3, 2)
        self.helper.assert_element_on_the_page(lines_4, 2)
        self.helper.assert_element_on_the_page(lines_5_6, 2)
        # check that the paragraph wrapper is registered as the beginning of
        # page 2
        self.helper.assert_element_on_the_page(
            '//div[@data-testid="paragraph"][@html2pdf4doc-page-start="2"]', 2
        )
