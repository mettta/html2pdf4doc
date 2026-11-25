import os

from seleniumbase import BaseCase

from test.end2end.helpers.helper import Helper

path_to_this_test_file_folder = os.path.dirname(os.path.abspath(__file__))

foot = '//*[@data-testid="foot"]'


class Test(BaseCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = Helper(self)

        #   TFOOT appears only once, in the final part of a split table.
        #   Before the fix, the original table (the first part) kept its
        #   TFOOT, and the final part got a clone of it.

    def test_tfoot(self):
        self.helper.open_case(path_to_this_test_file_folder, 'tfoot')
        self.helper.assert_html2pdf4doc_success()
        self.helper.assert_document_has_pages(3)
        assert len(self.find_elements(foot, by="xpath")) == 1
        self.helper.assert_element_on_the_page(foot, 3)
        self.helper.assert_element_on_the_page('//*[@data-testid="row-40"]', 3)
